import Link from "next/link";

export default function Forbidden() {
    return (
        <div style={{ padding: 24 }}>
            <h1>Access denied</h1>
            <p>You don't have access to this screen.</p>
            <Link href="/">Back to home</Link>
        </div>
    );
}