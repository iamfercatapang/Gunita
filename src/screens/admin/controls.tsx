// Building blocks shared by the admin panels. Class names match the
// existing stylesheet (styles.css, src/styles/admin.css).

import {
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { type AppConfig, getSettings, updateSettings } from '../../state/settings';
import { useSetting } from '../../ui/useSettings';

// ─── Panel frame ─────────────────────────────────────────────────────────────

export function PanelHeader({
  icon,
  title,
  sub,
  subClassName = 'content-header-sub',
}: { icon: ReactNode; title: string; sub?: ReactNode; subClassName?: string }) {
  return (
    <div className="content-header">
      <h1>
        {icon} {title}
      </h1>
      {sub && <p className={subClassName}>{sub}</p>}
    </div>
  );
}

export function FaIcon({ name, regular }: { name: string; regular?: boolean }) {
  return <i className={`${regular ? 'fa-regular' : 'fa-solid'} fa-${name}`} />;
}

/** A card with an icon, title and subtitle above its body. */
export function FormCard({
  id,
  icon,
  title,
  subtitle,
  children,
}: {
  id?: string;
  icon: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div id={id} className="settings-card admin-form-card">
      <div className="admin-form-card-head">
        <div className="admin-form-card-icon">{icon}</div>
        <div>
          <div className="admin-form-card-title">{title}</div>
          <div className="admin-form-card-subtitle">{subtitle}</div>
        </div>
      </div>
      <div className="admin-form-card-body">{children}</div>
    </div>
  );
}

// ─── Toggles ─────────────────────────────────────────────────────────────────

/** The ON/OFF pill switch. */
export function ToggleSwitch({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, since the visible text is only ON/OFF. */
  label: string;
}) {
  return (
    <label className={`toggle-switch${checked ? ' is-on' : ''}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-slider" />
      <span className="toggle-label" id={`${id}-label`}>
        {checked ? 'ON' : 'OFF'}
      </span>
    </label>
  );
}

type BooleanKey = {
  [K in keyof AppConfig]: AppConfig[K] extends boolean ? K : never;
}[keyof AppConfig];

/** A settings card with an icon, a title and an ON/OFF switch for one setting. */
export function FeatureToggle({
  id,
  setting,
  icon,
  title,
  subtitle,
}: {
  id: string;
  setting: BooleanKey;
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
}) {
  const on = useSetting(setting);
  return (
    <div className="settings-card feature-toggle-row">
      <div className="feature-toggle-left">
        <div className="feature-icon">{icon}</div>
        <div>
          <div className="feature-title">{title}</div>
          <div className="feature-subtitle">{subtitle}</div>
        </div>
      </div>
      <ToggleSwitch
        id={id}
        checked={on}
        label={title}
        onChange={(v) => updateSettings({ [setting]: v })}
      />
    </div>
  );
}

// ─── Sliders ─────────────────────────────────────────────────────────────────

type NumberKey = {
  [K in keyof AppConfig]: AppConfig[K] extends number ? K : never;
}[keyof AppConfig];

/** A labelled range slider for one numeric setting, in seconds. */
export function Slider({
  id,
  setting,
  label,
  min,
  max,
  step = 1,
  className = 'slider-group',
}: {
  id: string;
  setting: NumberKey;
  label: string;
  min: number;
  max: number;
  step?: number;
  className?: string;
}) {
  const value = useSetting(setting);
  return (
    <div className={className}>
      <div className="slider-header">
        <label htmlFor={id}>{label}</label>
        <div className="slider-value">
          <span id={id.replace(/^setting-/, 'val-')}>{value}</span> sec
        </div>
      </div>
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        className="custom-range"
        onChange={(e) => updateSettings({ [setting]: Number.parseInt(e.target.value, 10) })}
      />
    </div>
  );
}

// ─── Save destinations ───────────────────────────────────────────────────────

export function SaveDestCard({
  id,
  setting,
  icon,
  title,
}: {
  id: string;
  setting: BooleanKey;
  icon: string;
  title: string;
}) {
  const checked = useSetting(setting);
  return (
    <label className="save-dest-card" id={`lbl-${id.replace(/^chk-/, '')}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => updateSettings({ [setting]: e.target.checked })}
      />
      <div className="save-dest-inner">
        <span className="save-dest-icon">
          <FaIcon name={icon} />
        </span>
        <span className="save-dest-title">{title}</span>
        <span className="save-dest-check">
          <FaIcon name="check" />
        </span>
      </div>
    </label>
  );
}

// ─── Text fields ─────────────────────────────────────────────────────────────

type StringKey = {
  [K in keyof AppConfig]: AppConfig[K] extends string ? K : never;
}[keyof AppConfig];

/**
 * A text field for a setting that's stored cleaned up (trimmed, or with a
 * default when empty). The field keeps what the host is typing, so a
 * trailing space or an empty field doesn't fight the cursor.
 */
export function useDraftSetting(
  setting: StringKey,
  clean: (typed: string) => string = (t) => t,
  onCommit?: (value: string) => void,
): [string, (typed: string) => void] {
  const stored = useSetting(setting);
  const [draft, setDraft] = useState(stored);
  const lastCommitted = useRef(stored);

  // Changed elsewhere (e.g. restored settings): show the new value.
  useEffect(() => {
    if (stored !== lastCommitted.current) {
      lastCommitted.current = stored;
      setDraft(stored);
    }
  }, [stored]);

  const onType = useCallback(
    (typed: string) => {
      setDraft(typed);
      const value = clean(typed);
      lastCommitted.current = value;
      if (getSettings()[setting] !== value) {
        updateSettings({ [setting]: value });
        onCommit?.(value);
      }
    },
    [setting, clean, onCommit],
  );
  return [draft, onType];
}

// ─── File uploads ────────────────────────────────────────────────────────────

/**
 * A drop zone for one file. Clicking anywhere in it opens the picker, except
 * on its own buttons and labels. Returns the props for the zone and the
 * hidden file input.
 */
export function useFileZone(onFile: (file: File) => void, accepts: (file: File) => boolean) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const zone = {
    onClick: (e: MouseEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('button, label, input')) return;
      inputRef.current?.click();
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragEnter: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && accepts(file)) onFile(file);
    },
  };

  const input = {
    ref: inputRef,
    type: 'file' as const,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Clear it so picking the same file again still fires a change.
      e.target.value = '';
      if (file) onFile(file);
    },
  };

  return { zone, input, dragOver };
}

/** "Choose File": a label wrapping the hidden file input. */
export function ChooseFile({
  id,
  inputId,
  input,
  accept,
}: {
  id: string;
  inputId: string;
  input: ReturnType<typeof useFileZone>['input'];
  accept: string;
}) {
  return (
    <label className="btn-outline btn-upload admin-choose-file" id={id}>
      Choose File
      <input {...input} id={inputId} accept={accept} />
    </label>
  );
}
