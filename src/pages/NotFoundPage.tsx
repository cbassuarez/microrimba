import { Link } from 'react-router-dom';

export const NotFoundPage = () => (
  <div>
    <h1>404</h1>
    <p>Page not found.</p>
    <Link to="/">Back home</Link>
  </div>
);
