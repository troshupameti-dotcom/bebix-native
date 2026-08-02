export type LoginFormValues = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export type SignupFormValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

export type FormErrors<T> = Partial<Record<keyof T, string>>;
