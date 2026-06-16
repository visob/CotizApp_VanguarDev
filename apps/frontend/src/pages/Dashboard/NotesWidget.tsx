import { useState, useEffect, KeyboardEvent } from "react";
import "../../styles/dashboard.css";

interface Note {
  id: string;
  text: string;
  completed: boolean;
}

export function NotesWidget() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [inputValue, setInputValue] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("dashboard-notes");
      if (stored) {
        setNotes(JSON.parse(stored));
      } else {
        // Default mock notes
        setNotes([
          { id: "1", text: "Contactar a Polo Instalaciones", completed: false },
          { id: "2", text: "Revisar metricas", completed: false },
          { id: "3", text: "Registrar nuevos productos", completed: false }
        ]);
      }
    } catch (e) {
      console.error("Error loading notes", e);
    }
  }, []);

  // Save to localStorage when notes change
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem("dashboard-notes", JSON.stringify(notes));
    }
  }, [notes]);

  const toggleNote = (id: string) => {
    setNotes(notes.map(n => n.id === id ? { ...n, completed: !n.completed } : n));
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      const newNote: Note = {
        id: Date.now().toString(),
        text: inputValue.trim(),
        completed: false
      };
      setNotes([...notes, newNote]);
      setInputValue("");
    }
  };

  return (
    <div className="dashWidget notesWidget">
      <div className="notesList hide-scrollbar">
        {notes.length === 0 ? (
          <div className="hint" style={{ padding: "16px 0", textAlign: "center" }}>No tenés notas pendientes.</div>
        ) : (
          notes.map(note => (
            <label key={note.id} className="noteItem">
              <input 
                type="checkbox" 
                checked={note.completed} 
                onChange={() => toggleNote(note.id)}
                className="noteCheckbox"
              />
              <span className={`noteText ${note.completed ? 'noteText--completed' : ''}`}>
                {note.text}
              </span>
              {note.completed && (
                <button 
                  onClick={(e) => { e.preventDefault(); deleteNote(note.id); }}
                  className="noteDeleteBtn"
                  title="Eliminar"
                >
                  ×
                </button>
              )}
            </label>
          ))
        )}
      </div>
      <div className="noteInputWrap">
        <input 
          className="input"
          placeholder="Escribir..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
