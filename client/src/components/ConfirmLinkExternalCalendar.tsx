import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GoogleLogo from 'assets/google-g-logo.svg';
import MicrosoftLogo from 'assets/microsoft-logo.svg';
import { useAppSelector } from 'app/hooks';
import { selectTokenIsPresent } from 'slices/authentication';
import GenericSpinner from './GenericSpinner';
import { Link } from 'react-router-dom';
import { useToast } from './Toast';
import { getReqErrorMessage } from 'utils/requests.utils';
import ButtonWithSpinner from './ButtonWithSpinner';
import { useGetSelfInfoIfTokenIsPresent } from 'utils/auth.hooks';
import { useConfirmLinkGoogleAccountMutation, useConfirmLinkMicrosoftAccountMutation } from 'slices/api';

type OAuth2Provider = 'google' | 'microsoft';
const logos: Record<OAuth2Provider, string> = {
  'google': GoogleLogo,
  'microsoft': MicrosoftLogo,
};

export default function ConfirmLinkExternalCalendar({provider}: {provider: OAuth2Provider}) {
  const capitalizedProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
  const tokenIsPresent = useAppSelector(selectTokenIsPresent);
  const {data: userInfo} = useGetSelfInfoIfTokenIsPresent();
  const navigate = useNavigate();
  const confirmLinkGoogleAccountVals = useConfirmLinkGoogleAccountMutation();
  const confirmLinkMicrosoftAccountVals = useConfirmLinkMicrosoftAccountMutation();
  const [confirmLinkAccount, {isSuccess, isLoading, error}] = ({
    'google': confirmLinkGoogleAccountVals,
    'microsoft': confirmLinkMicrosoftAccountVals,
  } as const)[provider];
  const {showToast} = useToast();
  const [searchParams] = useSearchParams();
  // The token will be removed from the URL and stored in the Redux store from
  // another hook
  const token = searchParams.get('token');
  const postRedirect = searchParams.get('postRedirect');
  const encryptedEntity = searchParams.get('encryptedEntity');
  const iv = searchParams.get('iv');
  const salt = searchParams.get('salt');
  const tag = searchParams.get('tag');
  const requiredParamsArePresent = !!(postRedirect && encryptedEntity && iv && salt && tag);
  const shouldRedirectToHomePage = !requiredParamsArePresent || (!tokenIsPresent && !token)
  useEffect(() => {
    if (isSuccess) {
      showToast({
        msg: `Successfully linked ${capitalizedProvider} account`,
        msgType: 'success',
        autoClose: true,
      });
      navigate(postRedirect!);
    }
  }, [isSuccess, capitalizedProvider, showToast, navigate, postRedirect]);
  useEffect(() => {
    if (shouldRedirectToHomePage) {
      navigate('/');
    }
  }, [shouldRedirectToHomePage, navigate]);
  if (shouldRedirectToHomePage) {
    return null;
  }
  if (!userInfo) {
    return <GenericSpinner />;
  }
  const onClick = () => confirmLinkAccount({
    encrypted_entity: encryptedEntity,
    iv,
    salt,
    tag,
  });
  const btnDisabled = isLoading;
  return (
    <div className="align-self-center" style={{width: 'min(100%, 600px)'}}>
      <div className="d-flex align-items-center justify-content-between">
        <h3 className="mb-0">
          Link your {capitalizedProvider} account
        </h3>
        <img
          src={logos[provider]}
          alt={`${capitalizedProvider} Logo`}
          style={{maxHeight: '1.5em'}}
        />
      </div>
      <hr className="my-4" />
      <p>Welcome back, {userInfo.name}!</p>
      <p>
        You already have an account on CabbageMeet associated with
        the email address <strong>{userInfo.email}</strong>.
        Link your {capitalizedProvider} account to obtain the following benefits:
      </p>
      <ul>
        <li>Single sign-on with {capitalizedProvider}</li>
        <li>See your {capitalizedProvider} calendar events when adding your availabilities</li>
        <li>Synchronize your scheduled meetings with {capitalizedProvider} calendar</li>
      </ul>
      {error && (
        <p className="text-danger text-center mb-0 mt-4">An error occurred: {getReqErrorMessage(error)}</p>
      )}
      <div className="mt-5 d-flex justify-content-between">
        <Link to={postRedirect}>
          <button
            type="button"
            className="btn btn-outline-secondary px-4"
            disabled={btnDisabled}
          >
            Cancel
          </button>
        </Link>
        <ButtonWithSpinner
          className="btn btn-outline-primary"
          onClick={onClick}
          isLoading={btnDisabled}
        >
          Link {capitalizedProvider} account
        </ButtonWithSpinner>
      </div>
    </div>
  );
}
