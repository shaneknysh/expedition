import * as React from 'react'
import {icon} from '../../helpers'
import {CardType} from '../../reducers/StateTypes'


export default class CardFront extends React.Component<CardType, {}> {
  render() {
    const card = this.props.card;
    const theme = 'UrbanChaos';
    switch (card.sheet) {
      case 'Citizen':
        return (
          <div className={`card front vertical ${card.sheet}`}>
            <div className="contents">
              <header>
                <div className="name">{card.name}</div>
              </header>
              <article>
                <div className="score">
                  {card.scoreBlack === 'plus' && <div className="scoreBlack plus">+</div>}
                  {card.scoreBlack !== 'plus' && <div className="scoreBlack">{card.scoreBlack}</div>}
                  {card.scoreRed === 'minus' && <div className="scoreRed minus">-</div>}
                  {card.scoreRed !== 'minus' && <div className="scoreRed">{card.scoreRed}</div>}
                </div>
              </article>
              <footer>
                <div>{card.flavortext}</div>
              </footer>
            </div>
          </div>
        );
      case 'Event':
        return (
          <div className={`card front vertical ${card.sheet}`}>
            <div className="contents">
              <header>
                <div className="name">{card.name}</div>
              </header>
              <article>
                <div className="effects">{card.effects}</div>
              </article>
              <footer>
                <div>{card.flavortext}</div>
              </footer>
            </div>
          </div>
        );
      case 'Politics':
        let budget = null;
        if (card.cost !== null) {
          budget = [];
          if (card.cost > 0) {
            for (let i = card.cost; i > 0; i--) {
              budget.push(<span className="black">+</span>);
            }
          } else if (card.cost < 0) {
            for (let i = card.cost; i < 0; i++) {
              budget.push(<span className="red">-</span>);
            }
          }
          budget = <div className="costs">{budget}</div>;
        }
        return (
          <div className={`card front vertical ${card.sheet} ${card.committee}`}>
            <div className="contents">
              <header>
                <div className="name">{card.name}</div>
                <div className="type">{card.type}</div>
                {budget}
              </header>
              <article>
                <div className="score">
                  {card.scoreBlack1 && <div className="scoreBlack"><span>{card.scoreBlack1}</span><span>{card.scoreBlack2}</span></div>}
                  {card.scoreRed1 && <div className="scoreRed"><span>{card.scoreRed1}</span><span>{card.scoreRed2}</span></div>}
                </div>
                {card.effects && <div className="effects">{card.effects}</div>}
              </article>
              <footer>
                <div>{card.flavortext}</div>
              </footer>
            </div>
          </div>
        );
      case 'Reference':
        return (
          <div className={`card front vertical ${card.sheet}`}>
            <div className="contents">
              <article>
                <h3>End of quarter:</h3>
                <p>Bundle policies into bills</p>
                <p>Increment quarter tracker</p>
                <p>End of year: resolve (see back)</p>
                <p>&nbsp;</p>
                <h3>Resources:</h3>
                {icon(theme, 'transportation_small')} transportation<br/>
                {icon(theme, 'environment_small')} environment<br/>
                {icon(theme, 'health_small')} health<br/>
                {icon(theme, 'education_small')} education<br/>
                {icon(theme, 'jobs_small')} jobs<br/>
              </article>
            </div>
          </div>
        );
      default:
        return null;
    }
  }
}
