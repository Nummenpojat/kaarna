import { useLoginWithGoogleMutation, useSignupWithGoogleMutation } from 'slices/api';
import ContinueWithButton from './ContinueWithButton';


export default function ContinueWithNummaritiliButton({reason, className}: {reason: 'signup' | 'login', className?: string}) {
  return (
    <ContinueWithButton
      reason={reason}
      provider="nummaritili"
      useLoginMutation={useLoginWithGoogleMutation}
      useSignupMutation={useSignupWithGoogleMutation}
      title={"Nummaritili"}
      className={className}
    />
  );
};
