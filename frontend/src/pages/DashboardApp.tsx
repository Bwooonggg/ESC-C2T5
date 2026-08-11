import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentParent } from '../api/client'
import { logout } from '../api/auth'
import { Header, type Page } from '../components/Header'
import type { Parent, Student } from '../types/domain'
import { EmailUpdatesPage } from './EmailUpdatesPage'
import { ProgressPage } from './ProgressPage'

// The DAS 7 Parent Insight dashboard — everything App.tsx used to render
// directly before login/signup were wired in. Mounted at the protected "/"
// route; ProtectedRoute (see App.tsx) keeps signed-out visitors from ever
// reaching this component.
export function DashboardApp() {
    const [parent, setParent] = useState<Parent | null>(null)
    const [students, setStudents] = useState<Student[]>([])
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
    const [parentError, setParentError] = useState<string | null>(null)
    const [page, setPage] = useState<Page>('progress')
    const navigate = useNavigate()

    useEffect(() => {
        let cancelled = false

        async function loadParent() {
            try {
                const result = await getCurrentParent()

                if (!cancelled) {
                    setParent(result.parent)
                    setStudents(result.students)
                    setSelectedStudentId((currentStudentId) =>
                        currentStudentId && result.students.some(
                            (student) => student.studentId === currentStudentId,
                        )
                            ? currentStudentId
                            : result.students[0]?.studentId ?? null,
                    )
                }
            } catch (error) {
                if (!cancelled) {
                    setParentError(
                        error instanceof Error
                            ? error.message
                            : 'Unable to load parent details.',
                    )
                }
            }
        }

        void loadParent()

        return () => {
            cancelled = true
        }
    }, [])

    async function handleLogout() {
        await logout()
        navigate('/login')
    }

    const selectedStudent = students.find(
        (student) => student.studentId === selectedStudentId,
    )

    return (
        <>
            <Header
                parentName={parent?.name ?? null}
                page={page}
                onNavigate={setPage}
                onLogout={handleLogout}
            />

            <main className="page-container">
                {parentError && <p role="alert">{parentError}</p>}

                {!parent && !parentError && <p aria-busy="true">Loading parent details...</p>}

                {parent && page === 'progress' && selectedStudent && (
                    <ProgressPage
                        student={selectedStudent}
                        students={students}
                        onSelectStudent={setSelectedStudentId}
                    />
                )}

                {parent && page === 'email' && (
                    <EmailUpdatesPage parent={parent} childrenCount={students.length} />
                )}
            </main>
        </>
    )
}
