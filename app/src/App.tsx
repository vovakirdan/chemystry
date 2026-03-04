import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import {
  greetV1,
  healthV1,
  isCommandErrorV1,
  toUserFacingMessageV1,
} from "./shared/contracts/ipc/client";
import type { CommandErrorV1 } from "./shared/contracts/ipc/v1";
import "./App.css";

function formatCommandError(error: CommandErrorV1): string {
  return `${toUserFacingMessageV1(error)} [${error.code}] (ref: ${error.requestId})`;
}

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [healthMsg, setHealthMsg] = useState("Checking backend health...");
  const [name, setName] = useState("");

  useEffect(() => {
    let disposed = false;

    healthV1()
      .then((result) => {
        if (!disposed) {
          setHealthMsg(`Backend ${result.status} (${result.version}, ref: ${result.requestId})`);
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          if (isCommandErrorV1(error)) {
            setHealthMsg(`Backend error: ${formatCommandError(error)}`);
            return;
          }

          setHealthMsg(`Backend error ${String(error)}`);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  async function greet() {
    try {
      const result = await greetV1({ name });
      setGreetMsg(`${result.message} (ref: ${result.requestId})`);
    } catch (error: unknown) {
      if (isCommandErrorV1(error)) {
        setGreetMsg(formatCommandError(error));
        return;
      }

      setGreetMsg(`Unexpected error: ${String(error)}`);
    }
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>
      <p>{healthMsg}</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
