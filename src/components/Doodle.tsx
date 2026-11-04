import type { CSSProperties } from 'react';
import { DOODLE_H, DOODLE_URL, DOODLE_W } from '../doodle';

const VARS = { '--doodle': DOODLE_URL, '--doodle-size': `${DOODLE_W}px ${DOODLE_H}px` } as CSSProperties;

/**
 * The doodle pattern behind the sidebar. The sidebar has the `doodle-host` class (`position: relative`
 * and `isolation: isolate`), so the pattern sits above its background and below its content.
 */
export const DoodlePattern = () => <div className="doodle-pattern" aria-hidden="true" style={VARS} />;
