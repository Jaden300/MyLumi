/* Setup for the jsdom ("ui") test project. Unmounts between tests so a
   component that leaves state behind cannot leak into the next case. */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
