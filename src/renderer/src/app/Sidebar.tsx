import './library.css'
import { Plus, Folder, X } from 'lucide-react'
import type { Editor } from 'tldraw'
import { TagsSection } from './TagsSection'
import { PassageList } from './PassageList'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useStudySession, deleteStudy, chooseLibrary } from '../study/session'
import { RenameStudy } from './RenameStudy'
import { ToolButton } from './ToolButton'
import { iconMd, iconSm } from '../lib/icons'

export function Sidebar({
	onCreateStudy,
	editor,
}: {
	onCreateStudy: () => void
	editor: Editor | null
}) {
	const { studies, currentId, readOnly: libraryReadOnly, closing, setup } = useStudySession()
	const readOnly = libraryReadOnly || closing
	return (
		<aside id="sidebar" className="sidebar" aria-label="Library">
			<section aria-labelledby="studies-heading">
				<div className="section-heading">
					<h2 id="studies-heading">Studies</h2>
					<ToolButton label="New study" onClick={onCreateStudy} disabled={readOnly}>
						<Plus {...iconMd} aria-hidden="true" />
					</ToolButton>
				</div>
				{studies.length === 0 && <p className="sidebar-hint">Your studies will live here.</p>}
				<ul className="library-study-list">
					{studies.map((study) => (
						<li key={study.id} className="library-study-row">
							<RenameStudy
								id={study.id}
								title={study.title}
								disabled={readOnly}
								current={currentId === study.id}
							>
								<AlertDialog.Root>
									<AlertDialog.Trigger asChild>
										<button
											className="row-icon-button"
											disabled={readOnly}
											aria-label={`Delete ${study.title}`}
										>
											<X {...iconSm} aria-hidden="true" />
										</button>
									</AlertDialog.Trigger>
									<AlertDialog.Portal>
										<AlertDialog.Overlay className="dialog-overlay" />
										<AlertDialog.Content className="dialog-panel">
											<AlertDialog.Title>Delete {study.title}?</AlertDialog.Title>
											<AlertDialog.Description>
												The study file will be removed. A recovery version stays in Margin’s app
												data.
											</AlertDialog.Description>
											<div className="dialog-actions">
												<AlertDialog.Cancel asChild>
													<button className="button">Cancel</button>
												</AlertDialog.Cancel>
												<AlertDialog.Action asChild>
													<button
														className="button button-danger"
														onClick={() => void deleteStudy(study.id)}
													>
														Delete study
													</button>
												</AlertDialog.Action>
											</div>
										</AlertDialog.Content>
									</AlertDialog.Portal>
								</AlertDialog.Root>
							</RenameStudy>
						</li>
					))}
				</ul>
			</section>
			<PassageList editor={editor} />
			<TagsSection editor={editor} />
			<div className="sidebar-library">
				<button className="row-button" onClick={() => void chooseLibrary()}>
					<Folder {...iconMd} aria-hidden="true" />
					Library folder…{readOnly && setup === 'done' ? ' (read-only)' : ''}
				</button>
			</div>
		</aside>
	)
}
