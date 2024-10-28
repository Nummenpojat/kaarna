import useSetTitle from "utils/title.hook";


export default function Feedback() {
  useSetTitle('Palaute');
  return (
    <div className="mx-auto" style={{maxWidth: '600px'}}>
      <h3>Palaute</h3>
      <hr />
      <p>
        Jos sinulla on kysymyksiä tai parannusehdotuksia, ole hyvä ja suuntaa ne kohti Nummareiden vimaa 🙏
      </p>
    </div>
  );
}
