import { Link, useSearchParams } from "react-router-dom";
import { useVerifyEmailMutation } from "slices/api";
import { getReqErrorMessage } from "utils/requests.utils";
import useSetTitle from "utils/title.hook";
import useEffectOnce from "utils/useEffectOnce.hook";
import GenericSpinner from "./GenericSpinner";

export default function VerifyEmail() {
  const [verifyEmail, { isSuccess, error}] = useVerifyEmailMutation();
  const [searchParams] = useSearchParams();
  const encrypted_entity = searchParams.get('encrypted_entity');
  const iv = searchParams.get('iv');
  const salt = searchParams.get('salt');
  const tag = searchParams.get('tag');
  const urlIsValid = !!(encrypted_entity && iv && salt && tag);

  useSetTitle('Vahvista sähköpostiosoite');

  useEffectOnce(() => {
    if (!urlIsValid) return;
    verifyEmail({
      encrypted_entity,
      iv,
      salt,
      tag,
    });
  }, [urlIsValid, verifyEmail]);

  if (!isSuccess && !urlIsValid) {
    return (
      <p>Linkki on virheellinen.</p>
    );
  }

  if (error) {
    return (
      <p className="mt-3">
        Tapahtui virhe: {getReqErrorMessage(error)}
      </p>
    );
  }

  if (isSuccess) {
    return (
      <p>
        Sähköpostiosoite on nyt vahvistettu. Voit siirtyä kohti
        <Link to="/login">kirjautumissivua</Link>.
      </p>
    )
  }

  return <GenericSpinner />;
}
