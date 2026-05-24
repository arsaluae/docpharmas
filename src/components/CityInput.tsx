import { Input } from "@/components/ui/input";
import { CITY_OPTIONS } from "@/lib/pakistan-cities";

interface CityInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

/**
 * Free-text city input with autocomplete suggestions from the Pakistan cities list.
 * Users can type any city name (datalist provides suggestions but doesn't constrain input).
 */
export function CityInput({ value, onChange, placeholder = "Type or pick a city", id = "city-input" }: CityInputProps) {
  const listId = `${id}-list`;
  return (
    <>
      <Input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {CITY_OPTIONS.map((c) => (
          <option key={c.value} value={c.label} />
        ))}
      </datalist>
    </>
  );
}
