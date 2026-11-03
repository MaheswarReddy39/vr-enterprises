import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// The admin area is a lazily loaded chunk; the first render in a test file can exceed the 1s default.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => cleanup());

// jsdom does not implement these browser APIs.
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();
