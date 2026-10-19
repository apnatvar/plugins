// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDefaultState, updateSnippet } from '@prompt-composer/extension-storage';
import type { ExtensionMessage } from '@prompt-composer/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App, type MessageClient } from './App';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function createClient() {
  let state = createDefaultState();
  const client = vi.fn<MessageClient>(async (message: ExtensionMessage) => {
    await Promise.resolve();
    switch (message.type) {
      case 'GET_SNIPPETS':
        return state.snippets;
      case 'GET_SETTINGS':
        return state.settings;
      case 'GET_ACTIVE_EDITOR_STATUS':
        return { adapterId: 'generic-textarea', editorDetected: true, lastErrorCode: null };
      case 'SAVE_SNIPPET':
        state = updateSnippet(state, message.payload);
        return state.snippets;
      case 'DELETE_SNIPPET':
        state.snippets = state.snippets.filter((snippet) => snippet.id !== message.payload.id);
        return state.snippets;
      case 'RESET_SNIPPETS':
        state = createDefaultState();
        return state.snippets;
      case 'OPEN_SNIPPET_SETTINGS':
        return { ok: true };
      case 'UPDATE_SETTINGS':
        state.settings = message.payload;
        return state.settings;
      case 'REPORT_ACTIVE_EDITOR_STATUS':
        return { ok: true };
    }
  });
  return client;
}

describe('side panel', () => {
  it('lists, searches and opens the snippet editor form', async () => {
    const user = userEvent.setup();
    render(<App client={createClient()} />);
    expect(await screen.findByText('Code review')).toBeVisible();
    await user.type(screen.getByLabelText('Search snippets'), 'research');
    expect(screen.getByText('Research')).toBeVisible();
    expect(screen.queryByText('Code review')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('form', { name: 'Snippet editor' })).toBeVisible();
  });

  it('creates a validated snippet and persists it through typed messaging', async () => {
    const user = userEvent.setup();
    const client = createClient();
    render(<App client={client} />);
    await screen.findByText('Code review');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.type(screen.getByLabelText(/name/i), 'Test snippet');
    await user.type(screen.getByLabelText(/description/i), 'A test snippet');
    await user.type(screen.getByLabelText('Template'), 'Task: Test this.');
    await user.click(screen.getByRole('button', { name: 'Save snippet' }));
    expect(await screen.findByText('Test snippet')).toBeVisible();
    expect(client).toHaveBeenCalledWith(expect.objectContaining({ type: 'SAVE_SNIPPET' }));
  });

  it('edits and deletes existing snippets', async () => {
    const user = userEvent.setup();
    render(<App client={createClient()} />);
    const card = (await screen.findByText('Code review')).closest('article');
    expect(card).not.toBeNull();
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Snippet editor' });
    const name = within(form).getByLabelText('name');
    await user.clear(name);
    await user.type(name, 'Focused code review');
    await user.click(within(form).getByRole('button', { name: 'Save snippet' }));
    const updatedCard = (await screen.findByText('Focused code review')).closest('article');
    expect(updatedCard).not.toBeNull();
    await user.click(within(updatedCard as HTMLElement).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('Focused code review')).not.toBeInTheDocument();
  });

  it('validates and saves settings locally', async () => {
    const user = userEvent.setup();
    const client = createClient();
    render(<App client={client} />);
    await screen.findByText('Code review');
    await user.click(screen.getByRole('button', { name: /settings/i }));
    const enabled = screen.getByRole('checkbox', { name: /Extension enabled/ });
    expect(enabled).toBeChecked();
    await user.click(enabled);
    await waitFor(() => {
      const update = client.mock.calls
        .map(([message]) => message)
        .find((message) => message.type === 'UPDATE_SETTINGS');
      expect(update?.type).toBe('UPDATE_SETTINGS');
      if (update?.type === 'UPDATE_SETTINGS') expect(update.payload.enabled).toBe(false);
    });
  });

  it('defaults to a seeded allowlist and manages allowed hostnames', async () => {
    const user = userEvent.setup();
    render(<App client={createClient()} />);
    await screen.findByText('Code review');
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByRole('checkbox', { name: /All websites/ })).not.toBeChecked();
    expect(screen.getByText('chatgpt.com')).toBeVisible();
    expect(screen.getByText('claude.ai')).toBeVisible();
    expect(screen.getByText('www.meshy.ai')).toBeVisible();
    expect(screen.getByText('try.sarvam.ai')).toBeVisible();
    await user.type(screen.getByLabelText('Website hostname'), 'example.com');
    await user.click(screen.getByRole('button', { name: 'Allow' }));
    const websiteRow = (await screen.findByText('example.com')).closest('div');
    expect(websiteRow).not.toBeNull();
    expect(within(websiteRow as HTMLElement).getByText('Allowed')).toBeVisible();
    await user.click(within(websiteRow as HTMLElement).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('example.com')).not.toBeInTheDocument();
  });

  it('links privacy information to Brownsmith Dynamics', async () => {
    const user = userEvent.setup();
    render(<App client={createClient()} />);
    await screen.findByText('Code review');
    await user.click(screen.getByRole('button', { name: /privacy/i }));
    expect(screen.getByRole('link', { name: /brownsmithdynamics.com/i })).toHaveAttribute(
      'href',
      'https://brownsmithdynamics.com',
    );
  });
});
