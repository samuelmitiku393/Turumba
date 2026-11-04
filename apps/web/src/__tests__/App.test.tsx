import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders Turumba app', () => {
  render(<App />);
  expect(screen.getByText(/turumba/i)).toBeInTheDocument();
});