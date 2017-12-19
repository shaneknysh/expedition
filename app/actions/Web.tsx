import Redux from 'redux'
import {authSettings} from '../Constants'
import {toCard} from './Card'
import {initQuest} from './Quest'

import {setAnnouncement} from '../actions/Announcement'
import {openSnackbar} from '../actions/Snackbar'
import {userFeedbackClear} from '../actions/UserFeedback'
import {SearchSettings, SettingsType, QuestState, UserState, UserFeedbackState} from '../reducers/StateTypes'
import {QuestDetails} from '../reducers/QuestTypes'
import {getDevicePlatform, getAppVersion} from '../Globals'
import {logEvent} from '../Main'
import {TemplateContext} from '../cardtemplates/TemplateTypes'
import {defaultContext, ParserNode} from '../cardtemplates/Template'
import {remoteify} from './ActionTypes'
import {MIN_FEEDBACK_LENGTH} from '../Constants'

declare var window:any;
declare var require:any;
const cheerio = require('cheerio') as CheerioAPI;

// fetch can be used for anything except local files, so anything that might download from file://
// (aka quests) should use this instead
export function fetchLocal(url: string, callback: Function) {
  const request = new XMLHttpRequest();
  request.onload = function() {
    return callback(null, request.response);
  }
  request.onerror = () => {
    return callback(new Error('Network error'));
  }
  request.open('GET', url);
  request.send();
}

export const fetchQuestXML = remoteify(function fetchQuestXML(details: QuestDetails, dispatch: Redux.Dispatch<any>) {
  fetchLocal(details.publishedurl, (err: Error, result: string) => {
    if (err) {
      return dispatch(openSnackbar('Network error: Please check your connection.'));
    }
    const questNode = cheerio.load(result)('quest');
    dispatch(loadQuestXML({details, questNode, ctx: defaultContext()}));
  });

  return details;
});

// for loading quests in the app - Quest Creator injects directly into initQuest
function loadQuestXML(a: {details: QuestDetails, questNode: Cheerio, ctx: TemplateContext}) {
  return (dispatch: Redux.Dispatch<any>) => {
    // Quest start is here instead of initQuest because initQuest is also used by the editor
    // and would over-report.
    logEvent('quest_start', { ...a.details, action: a.details.title, label: a.details.id });

    dispatch(initQuest(a.details, a.questNode, a.ctx));

    const firstNode = a.questNode.children().eq(0);
    const node = new ParserNode(firstNode, a.ctx);

    if (node.elem[0].attribs.skipsetup) {
      dispatch(toCard({name: 'QUEST_CARD'}));
    } else {
      dispatch(toCard({name: 'QUEST_START'}));
    }

    return {...a, questNode: (null as Cheerio)};
  }
}

export function subscribe(a: {email: string}) {
  return (dispatch: Redux.Dispatch<any>) => {
    fetch(authSettings.urlBase + '/user/subscribe', {
      method: 'POST',
      body: JSON.stringify({email: a.email}),
    })
    .then(handleFetchErrors)
    .then((response: Response) => {
      return response.text();
    })
    .then((data: string) => {
      logEvent('user_subscribe', {});
      dispatch(openSnackbar('Thank you for subscribing!'));
    }).catch((error: Error) => {
      dispatch(openSnackbar('Error subscribing: ' + error));
    });
  };
};

export function submitUserFeedback(a: {quest: QuestState, settings: SettingsType, user: UserState, userFeedback: UserFeedbackState}) {
  return (dispatch: Redux.Dispatch<any>) => {
    if (a.userFeedback.rating < 3 && (!a.userFeedback.text || a.userFeedback.text.length < MIN_FEEDBACK_LENGTH)) {
      return alert('Sounds like the quest needs work! Please provide feedback of at least ' + MIN_FEEDBACK_LENGTH + ' characters to help the author improve.');
    } else if (a.userFeedback.text.length > 0 && a.userFeedback.text.length < MIN_FEEDBACK_LENGTH) {
      return alert('Reviews must be at least ' + MIN_FEEDBACK_LENGTH + ' characters to provide value to authors.');
    }

    const data = {
      questid: a.quest.details.id,
      userid: a.user.id,
      players: a.settings.numPlayers,
      difficulty: a.settings.difficulty,
      platform: getDevicePlatform(),
      version: getAppVersion(),
      email: a.user.email,
      name: a.user.name,
      rating: a.userFeedback.rating,
      text: a.userFeedback.text,
    };

    fetch(authSettings.urlBase + '/quest/feedback/' + a.userFeedback.type, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    .then(handleFetchErrors)
    .then((response: Response) => {
      return response.text();
    })
    .then((response: string) => {
      logEvent('user_feedback_' + a.userFeedback.type, { label: data.questid, value: data.rating });
      dispatch(userFeedbackClear());
      dispatch(openSnackbar('Review submitted. Thank you!'));
    }).catch((error: Error) => {
      logEvent('user_feedback_' + a.userFeedback.type + '_err', { label: error });
      dispatch(openSnackbar('Error submitting review: ' + error));
    });
  };
}

export function handleFetchErrors(response: any) {
  if (!response.ok) {
    throw Error(response.statusText);
  }
  return response;
}
