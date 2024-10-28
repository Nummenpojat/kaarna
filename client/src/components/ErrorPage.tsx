import { useSearchParams } from "react-router-dom";
import { capitalize } from 'utils/misc.utils';
import useSetTitle from "utils/title.hook";

function getOAuth2ErrorMessage(e: string, provider: string | null): string {
  provider = provider ?? 'Unknown';
  provider = capitalize(provider);
  if (e === 'E_OAUTH2_ACCOUNT_ALREADY_LINKED') {
    return (
      `Tämä ${provider} tili on jo linkitetty normaalitunnukseen. ` +
      `Sinun täytyy ensin vapauttaa tämä ${provider} tili normaalitunnuksesta.`
    );
  } else if (e === 'E_OAUTH2_NOT_AVAILABLE') {
    return `${provider} kirjautuminen ei ole käytössä tällä Kaarnalla 😭`;
  } else if (e === 'E_OAUTH2_NOT_ALL_SCOPES_GRANTED') {
    return 'Tarvittavia käyttöoikeuksia ei sallittu.';
  }
  return 'Jotakin tuntematonta tapahtui 🕵️';
}

export default function ErrorPage() {
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get('e');
  const errorMessage = errorCode === null
    ? null
    : errorCode.startsWith('E_OAUTH2')
    ? getOAuth2ErrorMessage(errorCode, searchParams.get('provider'))
    : 'Jotakin meni pahasti pieleen 💔';

  useSetTitle('Error');

  return (
    <>
      <p>Tapahtui virhe{errorMessage ? ':' : '.'}</p>
      {errorMessage && (
        <p>{errorMessage}</p>
      )}
    </>
  );
}
