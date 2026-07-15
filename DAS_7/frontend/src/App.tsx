import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { getCurrentParent } from './api/client'
import { SummaryComponent } from './components/summaryComponent'
import { RecommendationComponent } from './components/recommendationComponent'
import type { Parent, Student } from './types/domain'

function App() {
  const [count, setCount] = useState(0)
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
        {/* TODO */}
      </section>
      <section id="recommendations">
        {selectedStudent && (
          <RecommendationComponent
            key={selectedStudent.studentId}
            studentId={selectedStudent.studentId}
          />
        )}
      </section>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
