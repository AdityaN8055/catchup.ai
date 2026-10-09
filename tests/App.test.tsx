import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';

describe('App', () => {
  beforeEach(() => localStorage.clear());

  it('requires explicit consent before importing, then builds a report from samples', async () => {
    const user = userEvent.setup();
    render(<App />);
    const allow = screen.getByRole('button', { name: /allow on-device access/i });
    expect(allow).toBeDisabled();
    for (const box of screen.getAllByRole('checkbox')) await user.click(box.closest('label')!);
    await user.click(allow);

    await user.click(screen.getByRole('button', { name: /try sample chats/i }));
    await user.click(screen.getByRole('button', { name: /generate my briefing/i }));

    expect(screen.getByRole('heading', { name: /needs you/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /conversation summaries/i })).toBeInTheDocument();
  });

  it('wipes everything on revoke', async () => {
    const user = userEvent.setup();
    localStorage.setItem('catchup:consent', JSON.stringify(new Date().toISOString()));
    render(<App />);
    await user.click(screen.getByRole('button', { name: /revoke & wipe/i }));
    await user.click(screen.getByRole('button', { name: /revoke & wipe now/i }));
    expect(localStorage.getItem('catchup:consent')).toBeNull();
    expect(screen.getByRole('button', { name: /allow on-device access/i })).toBeInTheDocument();
  });
});
