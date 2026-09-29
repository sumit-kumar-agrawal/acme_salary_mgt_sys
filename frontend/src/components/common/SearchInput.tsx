import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";

const DEBOUNCE_MS = 300;
const MAX_LENGTH = 100; // API limit for q (§6.1)

interface SearchInputProps {
  label: string;
  placeholder?: string;
  initialValue?: string;
  /** Called with the trimmed text ("" means no search), 300 ms after typing stops or at once on Enter. */
  onSearch: (value: string) => void;
}

/** Debounced search box (S5). The text is never written to the URL (FD6b). */
export default function SearchInput({
  label,
  placeholder,
  initialValue = "",
  onSearch,
}: SearchInputProps) {
  const id = useId();
  const [text, setText] = useState(initialValue);
  const lastEmitted = useRef(initialValue.trim());
  const onSearchRef = useRef(onSearch);

  // Keep the latest callback without re-arming the debounce timer when the parent re-renders.
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  const emit = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed === lastEmitted.current) return;
    lastEmitted.current = trimmed;
    onSearchRef.current(trimmed);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => emit(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, emit]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    emit(text);
  }

  function clear() {
    setText("");
    emit("");
  }

  return (
    <Form role="search" onSubmit={handleSubmit}>
      <Form.Label htmlFor={id}>{label}</Form.Label>
      <InputGroup>
        <Form.Control
          id={id}
          type="search"
          value={text}
          maxLength={MAX_LENGTH}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
        />
        <Button
          variant="outline-secondary"
          onClick={clear}
          disabled={text === ""}

          aria-label={`Clear ${label.toLowerCase()}`}
        >
          Clear
        </Button>
      </InputGroup>
    </Form>
  );
}
