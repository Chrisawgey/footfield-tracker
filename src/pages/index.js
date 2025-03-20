import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1>Footy Tracker</h1>
      <Link href="/login">Login</Link> | <Link href="/dashboard">Dashboard</Link>
    </div>
  );
}
