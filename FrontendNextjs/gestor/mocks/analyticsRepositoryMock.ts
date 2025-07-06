import { TransactionRepositoryMock } from './transactionRepositoryMock'
import { Transaction } from '@/types/transaction'
import { AccountRepositoryMock } from './accountRepositoryMock'

export class AnalyticsRepositoryMock {
  private txRepo = new TransactionRepositoryMock()
  private accountRepo = new AccountRepositoryMock()

  /**
   * Overview: series de saldo, ingresos y gastos agrupados por intervalo
   */
  async getOverview(params: {
    accountId?: string
    categoryId?: string
    type?: 'INCOME' | 'BILL'
    dateFrom?: string
    dateTo?: string
    groupBy?: 'day' | 'week' | 'month' | 'year'
  }): Promise<{
    labels: string[]
    series: { id: string, data: { x: string, y: number }[] }[]
  }> {
    // Obtener transacciones filtradas
    const txs = await this.txRepo.getTransactions(params)
    // Agrupar por intervalo
    const groupBy = params.groupBy || 'month'
    const groupFn = (date: Date) => {
      if (groupBy === 'day') return date.toISOString().slice(0, 10)
      if (groupBy === 'week') {
        const d = new Date(date)
        const first = new Date(d.setDate(d.getDate() - d.getDay() + 1))
        return `${first.getFullYear()}-W${String(Math.ceil((d.getDate() + 6 - d.getDay()) / 7)).padStart(2, '0')}`
      }
      if (groupBy === 'year') return String(date.getFullYear())
      // default: month
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }
    const groups: Record<string, Transaction[]> = {}
    txs.forEach(tx => {
      const d = new Date(tx.created_at)
      const key = groupFn(d)
      if (!groups[key]) groups[key] = []
      groups[key].push(tx)
    })
    const labels = Object.keys(groups).sort()
    let saldo = 0
    const saldoData: { x: string, y: number }[] = []
    const ingresosData: { x: string, y: number }[] = []
    const gastosData: { x: string, y: number }[] = []
    labels.forEach(label => {
      const group = groups[label]
      const ingresos = group.filter(t => t.type_transaction === 1).reduce((sum, t) => sum + t.amount, 0)
      const gastos = group.filter(t => t.type_transaction === 0).reduce((sum, t) => sum + t.amount, 0)
      saldo += ingresos - gastos
      saldoData.push({ x: label, y: saldo })
      ingresosData.push({ x: label, y: ingresos })
      gastosData.push({ x: label, y: gastos })
    })
    return {
      labels,
      series: [
        { id: 'Saldo', data: saldoData },
        { id: 'Ingresos', data: ingresosData },
        { id: 'Gastos', data: gastosData },
      ]
    }
  }

  /**
   * Bar: datos apilados por categoría y fecha
   */
  async getBar(params: {
    accountId?: string
    categoryId?: string
    type?: 'INCOME' | 'BILL'
    dateFrom?: string
    dateTo?: string
    groupBy?: 'day' | 'week' | 'month' | 'year'
  }): Promise<{
    labels: string[]
    categories: string[]
    data: Record<string, any>[]
  }> {
    const txs = await this.txRepo.getTransactions(params)
    const groupBy = params.groupBy || 'month'
    const groupFn = (date: Date) => {
      if (groupBy === 'day') return date.toISOString().slice(0, 10)
      if (groupBy === 'week') {
        const d = new Date(date)
        const first = new Date(d.setDate(d.getDate() - d.getDay() + 1))
        return `${first.getFullYear()}-W${String(Math.ceil((d.getDate() + 6 - d.getDay()) / 7)).padStart(2, '0')}`
      }
      if (groupBy === 'year') return String(date.getFullYear())
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }
    const groups: Record<string, Transaction[]> = {}
    txs.forEach(tx => {
      const d = new Date(tx.created_at)
      const key = groupFn(d)
      if (!groups[key]) groups[key] = []
      groups[key].push(tx)
    })
    const labels = Object.keys(groups).sort()
    const allCategories = await new (require('./categoryRepositoryMock').CategoryRepositoryMock)().findAll()
    const categories = Array.from(new Set(txs.map(t => t.category_id)))
      .map((catId: string) => {
        const cat = allCategories.find((c: { id: string }) => c.id === catId)
        return cat ? cat.name : catId
      })
    const data = labels.map(label => {
      const row: Record<string, any> = { fecha: label }
      categories.forEach((catName: string) => {
        const catObj = allCategories.find((c: { name: string }) => c.name === catName)
        const catId = catObj ? catObj.id : catName
        row[catName] = groups[label].filter((t: any) => t.category_id === catId).reduce((sum: number, t: any) => sum + t.amount, 0)
      })
      return row
    })
    return { labels, categories, data }
  }

  /**
   * Pie: distribución por cuenta
   */
  async getPie(params: {
    accountId?: string
    categoryId?: string
    type?: 'INCOME' | 'BILL'
    dateFrom?: string
    dateTo?: string
  }): Promise<{
    id: string
    label: string
    value: number
    color: string
  }[]> {
    const txs = await this.txRepo.getTransactions(params)
    const accounts = Array.from(new Set(txs.map(t => t.account_id)))
    // Obtener nombres de cuenta
    const allAccounts = await this.accountRepo.findAll()
    return accounts.map(acc => {
      const accObj = allAccounts.find(a => a.id === acc)
      return {
        id: acc,
        label: accObj ? accObj.name_account : acc,
        value: txs.filter(t => t.account_id === acc).reduce((sum, t) => sum + t.amount, 0),
        color: '#2563eb',
      }
    }).filter(pie => pie.value > 0)
  }

  /**
   * Radar: comparación de categorías (gastos e ingresos)
   */
  async getRadar(params: {
    accountId?: string
    dateFrom?: string
    dateTo?: string
    type?: 'INCOME' | 'BILL'
  }): Promise<{
    categoria: string
    Gastos: number
    Ingresos: number
    total: number
  }[]> {
    const txs = await this.txRepo.getTransactions(params)
    const allCategories = await new (require('./categoryRepositoryMock').CategoryRepositoryMock)().findAll()
    const categories = Array.from(new Set(txs.map((t: any) => t.category_id)))
    const data = categories.map((catId: string) => {
      const gastos = txs.filter((t: any) => t.category_id === catId && t.type_transaction === 0).reduce((sum: number, t: any) => sum + t.amount, 0)
      const ingresos = txs.filter((t: any) => t.category_id === catId && t.type_transaction === 1).reduce((sum: number, t: any) => sum + t.amount, 0)
      const cat = allCategories.find((c: { id: string }) => c.id === catId)
      return { categoria: cat ? cat.name : catId, Gastos: gastos, Ingresos: ingresos, total: gastos + ingresos }
    })
    return data.sort((a: any, b: any) => b.total - a.total).slice(0, 5)
  }

  /**
   * Heatmap: actividad por día de la semana y mes
   */
  async getHeatmap(params: {
    accountId?: string
    categoryId?: string
    type?: 'INCOME' | 'BILL'
    dateFrom?: string
    dateTo?: string
  }): Promise<{
    id: string
    data: { x: string, y: number }[]
  }[]> {
    const txs = await this.txRepo.getTransactions(params)
    const monthsLabels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
    return days.map((day, i) => {
      const data = monthsLabels.map(month => {
        const count = txs.filter(tx => {
          const date = new Date(tx.created_at)
          return date.getDay() === ((i + 1) % 7) && monthsLabels[date.getMonth()] === month
        }).length
        return { x: month, y: count }
      })
      return { id: day, data }
    })
  }
} 