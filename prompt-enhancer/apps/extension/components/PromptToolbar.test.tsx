// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextareaEditorAdapter, type ActiveEditor } from '@prompt-composer/editor-adapters';
import { DEFAULT_SNIPPETS } from '@prompt-composer/prompt-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromptToolbar } from './PromptToolbar';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function createActive(value = 'Build a card. Use TypeScript.'): ActiveEditor {
  const element = document.createElement('textarea');
  element.value = value;
  document.body.append(element);
  return { adapter: new TextareaEditorAdapter(), element };
}

describe('PromptToolbar', () => {
  it('has accessible controls and arrow-key navigation', () => {
    render(<PromptToolbar active={createActive()} />);
    const format = screen.getByRole('button', { name: 'Format' });
    const snippets = screen.getByRole('button', { name: 'Snippets' });
    format.focus();
    fireEvent.keyDown(format, { key: 'ArrowRight' });
    expect(snippets).toHaveFocus();
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Prompt Composer tools');
    expect(screen.queryByRole('button', { name: 'Structure' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shorten' })).not.toBeInTheDocument();
  });

  it.skip('shows compression levels and prepares a non-destructive result', async () => {
    const user = userEvent.setup();
    const prepare = vi.fn();
    const active = createActive();
    render(<PromptToolbar active={active} onPrepareTransform={prepare} />);
    await user.click(screen.getByRole('button', { name: 'Shorten' }));
    await user.click(screen.getByRole('menuitem', { name: /Balanced/i }));
    expect(prepare).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Review transformation' })).toBeVisible();
    expect(active.adapter.readText(active.element)).toBe('Build a card. Use TypeScript.');
  });

  it('searches snippet commands without expanding ordinary words', async () => {
    const user = userEvent.setup();
    render(<PromptToolbar active={createActive()} />);
    await user.click(screen.getByRole('button', { name: 'Snippets' }));
    await user.type(screen.getByRole('textbox', { name: 'Search snippets' }), 'research');
    expect(screen.getByRole('option', { name: /^Research/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /Code review/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Configure snippets/ })).toBeVisible();
  });

  it('keeps configuration last in a bounded snippet list', async () => {
    const user = userEvent.setup();
    const configure = vi.fn();
    const snippets = Array.from({ length: 8 }, (_, index) => ({
      ...DEFAULT_SNIPPETS[index % DEFAULT_SNIPPETS.length]!,
      id: `personal-${index}`,
      name: `Personal ${index + 1}`,
    }));
    render(
      <PromptToolbar active={createActive()} snippets={snippets} onConfigureSnippets={configure} />,
    );
    await user.click(screen.getByRole('button', { name: 'Snippets' }));
    const list = screen.getByRole('listbox', { name: 'Snippet commands' });
    expect(list).toHaveClass('pc-snippet-list');
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(9);
    expect(options.at(-1)).toHaveAccessibleName(/Configure snippets/);
    await user.click(options.at(-1) as HTMLElement);
    expect(configure).toHaveBeenCalledOnce();
  });

  it('renders deterministic lint findings and adaptive theme hooks', async () => {
    const user = userEvent.setup();
    const { container } = render(<PromptToolbar active={createActive('Make it better.')} />);
    await user.click(screen.getByRole('button', { name: /Review/ }));
    expect(screen.getByLabelText('Prompt review').closest('.pc-panel-surface')).toHaveAttribute(
      'data-panel-placement',
      'above',
    );
    const findingTitle = screen.getByText('Ambiguous Task');
    const finding = findingTitle.closest('details');
    expect(finding).not.toHaveAttribute('open');
    await user.click(findingTitle);
    expect(finding).toHaveAttribute('open');
    expect(within(finding as HTMLElement).getByText('Possible solution')).toBeVisible();
    expect(screen.getByLabelText('Prompt review')).toHaveTextContent(
      'Name the input and the desired change.',
    );
    expect(container.querySelector('[data-theme="adaptive"]')).toBeInTheDocument();
  });

  it('closes menus with Escape and restores editor focus', async () => {
    const user = userEvent.setup();
    const active = createActive();
    render(<PromptToolbar active={active} />);
    await user.click(screen.getByRole('button', { name: 'Format' }));
    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Output format' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(active.element);
  });

  it.skip('requires confirmation, replaces the draft and restores exact text with Undo', async () => {
    const user = userEvent.setup();
    const original = 'Build a card. Use TypeScript. Use TypeScript.';
    const active = createActive(original);
    render(<PromptToolbar active={active} />);
    await user.click(screen.getByRole('button', { name: 'Shorten' }));
    await user.click(screen.getByRole('menuitem', { name: /Light/i }));
    expect(active.adapter.readText(active.element)).toBe(original);
    await user.click(screen.getByRole('button', { name: 'Replace draft' }));
    expect(active.adapter.readText(active.element)).not.toBe(original);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(active.adapter.readText(active.element)).toBe(original);
  });

  it.skip('shows the required aggressive-loss warning before replacement', async () => {
    const user = userEvent.setup();
    render(
      <PromptToolbar active={createActive('Build a card. Background that may be incidental.')} />,
    );
    await user.click(screen.getByRole('button', { name: 'Shorten' }));
    await user.click(screen.getByRole('menuitem', { name: /Aggressive/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('may remove context');
    expect(screen.getByRole('button', { name: 'Replace draft' })).toBeEnabled();
  });

  it('previews a snippet before inserting it', async () => {
    const user = userEvent.setup();
    const active = createActive('Selected code');
    render(<PromptToolbar active={active} />);
    await user.click(screen.getByRole('button', { name: 'Snippets' }));
    await user.click(screen.getByRole('option', { name: /Code review/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Review the following code');
    expect(active.adapter.readText(active.element)).toBe('Selected code');
  });
});
