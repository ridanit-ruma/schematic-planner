import type { ReactNode } from 'react';

/** Signing in and creating an account. */
export const auth = {
  documentTitle: {
    signIn: 'Sign in',
    signUp: 'Create an account',
  },
  intro: {
    signIn: 'Sign in to your plans.',
    signUp: 'Set up an account and a workspace to plan in.',
  },
  name: 'Name',
  email: 'Email',
  password: 'Password',
  passwordHint: 'At least 10 characters.',
  invitation: {
    label: 'Invitation',
    byInvitation: 'Sign-up here is by invitation. Ask whoever runs this instance for a link.',
    fromLink: 'From the link you followed.',
  },
  submit: {
    signIn: 'Sign in',
    signUp: 'Create account',
  },
  switch: {
    noAccount: (link: ReactNode) => <>No account yet? {link}</>,
    createOne: 'Create one',
    haveAccount: (link: ReactNode) => <>Already have an account? {link}</>,
    signIn: 'Sign in',
  },
};
