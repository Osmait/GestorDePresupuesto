import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

describe('Checkbox', () => {
	it('is a labelled checkbox that toggles', async () => {
		const user = userEvent.setup()
		const onCheckedChange = vi.fn()
		render(
			<>
				<Checkbox id='include' onCheckedChange={onCheckedChange} />
				<Label htmlFor='include'>Include</Label>
			</>,
		)

		const box = screen.getByRole('checkbox', { name: 'Include' })
		expect(box).toHaveAttribute('aria-checked', 'false')
		await user.click(box)
		expect(onCheckedChange).toHaveBeenCalledWith(true)
	})
})
