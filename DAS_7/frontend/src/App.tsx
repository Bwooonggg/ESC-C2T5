import { useEffect, useState } from 'react'
import './App.css'
import { getCurrentParent } from './api/client'
import { SummaryComponent } from './components/summaryComponent'
import { RecommendationComponent } from './components/recommendationComponent'
import type { Parent, Student } from './types/domain'
import { ProgressChart } from './components/progressChart'

function App() {
  const [parent, setParent] = useState<Parent | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [parentError, setParentError] = useState<string | null>(null)

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

  const selectedStudent = students.find(
    (student) => student.studentId === selectedStudentId,
  )

  return (
    <>
      <header>
        {parent && <h2>Welcome, {parent.name}</h2>}
        {selectedStudent && (
          <p>Showing progress of {selectedStudent.name}</p>
        )}
        {parentError && <p role="alert">{parentError}</p>}
        {!parent && !parentError && <p>Loading parent details...</p>}

        {students.length > 1 && (
          <label htmlFor="student-select">
            Choose a child:{' '}
            <select
              id="student-select"
              value={selectedStudentId ?? ''}
              onChange={(event) => setSelectedStudentId(event.target.value)}
            >
              {students.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <section id="summary">
        <h1>Summary</h1>
        {selectedStudent && (
          <SummaryComponent
            key={selectedStudent.studentId}
            studentId={selectedStudent.studentId}
          />
        )}
      </section>
      <section id="data">
        <h1>Progress</h1>
        {selectedStudent && (
          <ProgressChart studentId={selectedStudent.studentId} />
        )}
      </section>
      <section id="recommendations">
        {selectedStudent && (
          <RecommendationComponent
            key={selectedStudent.studentId}
            studentId={selectedStudent.studentId}
          />
        )}
      </section>

      <section id="spacer"></section>
    </>
  )
}

export default App
