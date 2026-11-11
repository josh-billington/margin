import { useState } from 'react'
import { strongIdSchema } from '@shared/lexicon/types'

export function ManualLookup({ lookup }: { lookup: (id: string) => void }) {
	const [value, setValue] = useState('')
	const [namespace, setNamespace] = useState<'H' | 'G' | ''>('')
	const [error, setError] = useState('')
	const bare = /^\d+$/.test(value.trim())
	return (
		<form
			className="lookup-manual"
			onSubmit={(event) => {
				event.preventDefault()
				if (bare && !namespace) return setError('Choose Hebrew or Greek for this number.')
				const parsed = strongIdSchema.safeParse(bare ? namespace + value.trim() : value)
				if (!parsed.success) return setError('Enter a Strong’s number, such as H1254 or G3056.')
				setError('')
				lookup(parsed.data)
			}}
		>
			<label>
				Strong’s number
				<input
					value={value}
					onChange={(event) => {
						setValue(event.target.value)
						setError('')
					}}
					placeholder="H1254 or G3056"
					autoComplete="off"
				/>
			</label>
			{bare && (
				<label>
					Dictionary
					<select
						value={namespace}
						onChange={(event) =>
							setNamespace(event.target.value === 'H' ? 'H' : event.target.value === 'G' ? 'G' : '')
						}
					>
						<option value="">Choose Hebrew or Greek</option>
						<option value="H">Hebrew</option>
						<option value="G">Greek</option>
					</select>
				</label>
			)}
			{error && <p role="alert">{error}</p>}
			<button type="submit">Look up number</button>
		</form>
	)
}
