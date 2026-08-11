import { Link } from "react-router-dom";

export function NotFoundPage() {
    return <main className="message-page"><p>404</p><h1>Page not found</h1><p>The page may have moved or no longer exists.</p><Link to="/">Return home</Link></main>;
}
