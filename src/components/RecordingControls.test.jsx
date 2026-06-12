import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordingControls } from './RecordingControls';

// A minimal recording stub; export returns a fixed envelope, import is spied.
function makeRecording(importImpl) {
  return {
    export: () => ({ format: 'rtt-recording', version: 1, windowMs: 1000, snapshots: [] }),
    import: importImpl ?? vi.fn(),
  };
}

function fileOf(text) {
  const f = new File([text], 'recording.json', { type: 'application/json' });
  return f;
}

describe('RecordingControls', () => {
  it('renders an export action and an import file input', () => {
    render(<RecordingControls recording={makeRecording()} />);
    expect(screen.getByRole('button', { name: /export recording/i })).toBeDefined();
    expect(screen.getByLabelText(/import recording/i)).toBeDefined();
  });

  it('imports the selected file through the recording', async () => {
    const importFn = vi.fn();
    render(<RecordingControls recording={makeRecording(importFn)} />);

    const input = screen.getByLabelText(/import recording/i);
    fireEvent.change(input, { target: { files: [fileOf('{"format":"rtt-recording"}')] } });

    await waitFor(() => expect(importFn).toHaveBeenCalledWith('{"format":"rtt-recording"}'));
  });

  it('shows a clear error message when the import is refused', async () => {
    const importFn = vi.fn(() => { throw new Error('Unsupported Recording version: 2 (expected 1).'); });
    render(<RecordingControls recording={makeRecording(importFn)} />);

    const input = screen.getByLabelText(/import recording/i);
    fireEvent.change(input, { target: { files: [fileOf('whatever')] } });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/unsupported recording version/i);
    });
  });
});
