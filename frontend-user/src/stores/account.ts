import axios, { AxiosError } from 'axios';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { defineStore } from 'pinia';
import { useCommonStore } from '@/stores/common';
import { useAuthModalStore } from '@/stores/auth_modal';
import type { FavoriteGenre, FavoritePrefecture } from '@/types/favorite';

interface AccountState {
  id: number | null;
  user_id: number | null;
  uuid: string | null;
  status: string | null;
  display_name: string;
  handle_name: string;
  email: string | null;
  avatar_url: string | null;
  registered_at: string;
  post_summary: number;
  favorite_genres: FavoriteGenre[];
  favorite_prefectures: FavoritePrefecture[];
  isNewRegistration?: boolean;
  errors: Record<string, string[]>;
}

interface ValidationErrorResponse {
  errors: Record<string, string[]>;
}

export const useAccountStore = defineStore('account', () => {
  const state = ref<AccountState>({
    id: null,
    user_id: null,
    uuid: null,
    status: null,
    display_name: '',
    handle_name: '',
    email: null,
    avatar_url: null,
    registered_at: '',
    post_summary: 0,
    favorite_genres: [],
    favorite_prefectures: [],
    errors: {}
  });

  const router = useRouter();
  const commonStore = useCommonStore();

  const isLoadingUserData = ref<boolean>(true);
  const isAuthenticated = computed((): boolean => !!state.value.id);

  function setData(data: AccountState): void {
    state.value = { ...data };
  }

  function resetData(): void {
    state.value = {
      id: null,
      user_id: null,
      uuid: null,
      status: null,
      display_name: '',
      handle_name: '',
      email: null,
      avatar_url: null,
      registered_at: '',
      post_summary: 0,
      favorite_genres: [],
      favorite_prefectures: [],
      errors: {}
    };
  }

  function setErrors(errors: Record<string, string[]>): void {
    state.value.errors = { ...errors };
  }

  function resetErrors(): void {
    state.value.errors = {};
  }

  // axiosのエラーかどうかチェック
  function isAxiosError(error: any): error is AxiosError {
    return !!error.isAxiosError;
  }

  function updateDisplayName(displayName: string): void {
    state.value.display_name = displayName;
  }

  function updateAvatar(avatar: string | null): void {
    state.value.avatar_url = avatar;
  }

  function updateFavoriteGenres(selectedGenres: number[]): void {
    state.value.favorite_genres = selectedGenres.map((genre_id) => ({ genre_id }));
  }

  function updateFavoritePrefectures(selectedPrefectures: number[]): void {
    state.value.favorite_prefectures = selectedPrefectures.map((prefecture_id) => ({
      prefecture_id
    }));
  }

  function emailValidate(email: string): boolean {
    const errors: Record<string, string[]> = {};
    const emailRegex: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      errors.email = ['メールアドレスを入力してください'];
    } else if (!emailRegex.test(email)) {
      errors.email = ['有効なメールアドレスを入力してください'];
    }

    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return false;
    }

    resetErrors();
    return true;
  }

  function tokenValidate(token: string): boolean {
    const errors: Record<string, string[]> = {};

    if (!token) {
      errors.token = ['認証コードを入力してください'];
    }

    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return false;
    }

    resetErrors();
    return true;
  }

  // tokenメール送信
  async function generateToken(payload: { email: string }): Promise<boolean> {
    try {
      await axios.get('/sanctum/csrf-cookie');
      await axios.post('/api/service_users/generate-token', {
        email: payload.email
      });

      return true;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const { response } = error;
          if (response.status === 422) {
            setErrors({ email: ['有効なメールアドレスを指定してください。'] });
            return false;
          }
        }
      }
      throw error;
    }
  }

  // ログイン
  async function login(payload: { email: string; token: string }): Promise<boolean> {
    const authModalStore = useAuthModalStore();

    try {
      const response = await axios.post('/api/service_users/login', {
        email: payload.email,
        token: payload.token
      });

      if (response.status === 200) {
        setData(response.data.data);
        resetErrors();
        await router.push({ name: 'Home' }).then((): void => {
          commonStore.setFlashMessage('ログインしました');
          setTimeout(() => {
            commonStore.clearFlashMessage();
          }, 4000);
        });
      }
      return true;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const { response } = error;
          if (response.status === 422) {
            setErrors(response.data.errors as ValidationErrorResponse['errors']);
            return false;
          } else if (response.status === 401) {
            if (response.data.is_unmatched) {
              setErrors({ token: ['認証コードが違います。'] } as Record<string, string[]>);
              return false;
            } else if (response.data.is_expired) {
              setErrors({ token: ['有効期限切れのコードです'] } as Record<string, string[]>);
              return false;
            } else if (response.data.status === 'pending') {
              state.value.isNewRegistration = true;
              authModalStore.closeAuthModal();
              router.push({ name: 'Signup' });
              return false;
            } else {
              setErrors({ auth: ['メールアドレスまたは認証コードが違います。'] });
              return false;
            }
          } else if (response.status === 429) {
            setErrors({ token: [response.data.message] } as Record<string, string[]>);
            return false;
          }
        }
      }
      throw error;
    }
  }

  async function fetchUserData(): Promise<AccountState | null> {
    try {
      const response = await axios.get('/api/service_users/me');
      setData(response.data.data);
      return state.value;
    } catch (error) {
      if (isAxiosError(error)) {
        const { response } = error;
        if (response && response.status === 401) {
          resetData();
          return null;
        } else {
          setErrors({ general: ['予期せぬエラーが発生しました。'] });
          return null;
        }
      } else {
        setErrors({ general: ['予期せぬエラーが発生しました。'] });
        return null;
      }
    } finally {
      isLoadingUserData.value = false;
    }
  }

  // ログアウト
  async function logout(): Promise<void> {
    try {
      commonStore.startApiLoading();
      await axios.post('/api/service_users/logout');
      resetData();
      commonStore.setFlashMessage('ログアウトしました');
      router.push({ name: 'Welcome' });
      setTimeout(() => {
        commonStore.clearFlashMessage();
      }, 4000);
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const { response } = error;
        if (response && response.status === 401) {
          setErrors({ auth: ['ログアウトに失敗しました。'] });
        } else {
          setErrors({ general: ['予期せぬエラーが発生しました。'] });
        }
      } else {
        setErrors({ general: ['予期せぬエラーが発生しました。'] });
      }
    } finally {
      commonStore.stopApiLoading();
    }
  }

  return {
    state,
    isLoadingUserData,
    isAuthenticated,
    setData,
    resetData,
    setErrors,
    resetErrors,
    isAxiosError,
    updateDisplayName,
    updateAvatar,
    updateFavoriteGenres,
    updateFavoritePrefectures,
    emailValidate,
    tokenValidate,
    generateToken,
    login,
    fetchUserData,
    logout
  };
});
