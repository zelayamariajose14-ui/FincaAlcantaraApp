import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Reemplaza con tus datos reales de Supabase
const SUPABASE_URL = 'https://ynbxuauormuxmhxpzrfp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JpOF0bwEeun_d8dA6BfhgA__5qnp4Gu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});