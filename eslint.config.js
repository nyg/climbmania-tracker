import { base, react } from '@nyg/eslint-config'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
   globalIgnores(['public/**']),
   base,
   react,
])
