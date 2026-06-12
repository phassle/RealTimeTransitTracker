import { useRef, useState } from 'react';
import './RecordingControls.css';

// RecordingControls — export the session observation buffer to a JSON file on
// disk and load such a file back so Replay can play the captured window
// (PRD #84 stories 25, 30). Files live on the user's disk only — no client
// storage (ADR 0001/0003). A malformed or wrong-version file is refused with a
// clear message; the live session is unaffected because the buffer validates
// before mutating.

function downloadJson(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function RecordingControls({ recording }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

  function handleExport() {
    setError(null);
    const text = JSON.stringify(recording.export());
    downloadJson('transit-recording.json', text);
  }

  async function handleImport(e) {
    setError(null);
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file fires change again.
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      recording.import(text);
    } catch (err) {
      setError(err?.message || 'Could not import the Recording.');
    }
  }

  return (
    <div className="recording-controls">
      <button
        type="button"
        className="recording-controls__export"
        onClick={handleExport}
      >
        Export recording
      </button>
      <label className="recording-controls__import">
        Import recording
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
        />
      </label>
      {error && (
        <p className="recording-controls__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
