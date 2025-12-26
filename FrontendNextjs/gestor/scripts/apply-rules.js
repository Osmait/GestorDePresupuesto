#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Directorios a procesar
const DIRECTORIES = [
	'app',
	'components',
	'hooks',
	'lib',
	'mocks',
	'types',
	'examples',
]

// Extensiones de archivos a procesar
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

console.log('🔧 Aplicando reglas de código al proyecto...')

function getAllFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir)
	
	files.forEach((file) => {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)
		
		if (stat.isDirectory()) {
			// Ignorar node_modules y .next
			if (!['node_modules', '.next', '.git'].includes(file)) {
				getAllFiles(filePath, fileList)
			}
		} else {
			const ext = path.extname(file)
			if (FILE_EXTENSIONS.includes(ext)) {
				fileList.push(filePath)
			}
		}
	})
	
	return fileList
}

function applyRules(filePath) {
	try {
		let content = fs.readFileSync(filePath, 'utf8')
		let changed = false
		
		// Aplicar reglas básicas
		
		// 1. Cambiar double quotes por single quotes (excepto en JSX)
		const singleQuoteRegex = /"([^"]*?)"/g
		const newContent1 = content.replace(singleQuoteRegex, (match, p1) => {
			// No cambiar si está dentro de JSX o contiene single quotes
			if (p1.includes("'")) return match
			return `'${p1}'`
		})
		if (newContent1 !== content) {
			content = newContent1
			changed = true
		}
		
		// 2. Eliminar semicolons al final de línea
		const semicolonRegex = /;(\s*$)/gm
		const newContent2 = content.replace(semicolonRegex, '$1')
		if (newContent2 !== content) {
			content = newContent2
			changed = true
		}
		
		// 3. Cambiar espacios por tabs al inicio de línea
		const indentRegex = /^( {2,})/gm
		const newContent3 = content.replace(indentRegex, (match) => {
			const spaceCount = match.length
			const tabCount = Math.floor(spaceCount / 2)
			return '\t'.repeat(tabCount)
		})
		if (newContent3 !== content) {
			content = newContent3
			changed = true
		}
		
		if (changed) {
			fs.writeFileSync(filePath, content, 'utf8')
			console.log(`✅ Actualizado: ${filePath}`)
			return true
		}
		
		return false
	} catch (error) {
		console.error(`❌ Error procesando ${filePath}:`, error.message)
		return false
	}
}

function main() {
	let totalFiles = 0
	let changedFiles = 0
	
	// Procesar cada directorio
	DIRECTORIES.forEach((dir) => {
		if (fs.existsSync(dir)) {
			console.log(`\n📁 Procesando directorio: ${dir}`)
			const files = getAllFiles(dir)
			
			files.forEach((file) => {
				totalFiles++
				if (applyRules(file)) {
					changedFiles++
				}
			})
		}
	})
	
	console.log('\n📊 Resumen:')
	console.log(`📄 Archivos procesados: ${totalFiles}`)
	console.log(`✨ Archivos modificados: ${changedFiles}`)
	
	if (changedFiles > 0) {
		console.log('\n🎯 Ejecutando Prettier para formato final...')
		try {
			execSync('npx prettier --write "**/*.{ts,tsx,js,jsx}"', { stdio: 'inherit' })
			console.log('✅ Prettier ejecutado exitosamente')
		} catch (error) {
			console.log('⚠️ Prettier no disponible, saltando formato automático')
		}
	}
	
	console.log('\n🎉 ¡Aplicación de reglas completada!')
}

if (require.main === module) {
	main()
}

module.exports = { applyRules, getAllFiles } 