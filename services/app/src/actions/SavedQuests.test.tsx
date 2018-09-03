import {Quest} from 'shared/schema/Quests';
import {defaultContext} from '../components/views/quest/cardtemplates/Template';
import {ParserNode} from '../components/views/quest/cardtemplates/TemplateTypes';
import {getCheerio} from '../Globals';
import {getStorageJson, getStorageString} from '../LocalStorage';
import {deleteSavedQuest, listSavedQuests, loadSavedQuest, SAVED_QUESTS_KEY, savedQuestKey, storeSavedQuest} from './SavedQuests';

describe('SavedQuest actions', () => {
  const STORED_QUEST_ID = '12345';
  const STORED_QUEST_TS = 67890;
  beforeEach(() => {
    const quest = getCheerio().load('<quest><roleplay><choice></choice><choice if="false"></choice><choice><roleplay>expected</roleplay><roleplay>wrong</roleplay></choice></roleplay></quest>')('quest');
    const pnode = new ParserNode(quest.children().eq(0), defaultContext());
    const next = pnode.getNext(1);
    if (next === null) {
      throw new Error('Initial setup failed');
    }
    storeSavedQuest(next, {id: STORED_QUEST_ID} as any as Quest, STORED_QUEST_TS);
  });
  afterEach(() => {
    localStorage.clear();
  });

  describe('deleteSavedQuest', () => {
    test('removes both the listing and the data', () => {
      deleteSavedQuest(STORED_QUEST_ID, STORED_QUEST_TS);
      expect(getStorageString(savedQuestKey(STORED_QUEST_ID, STORED_QUEST_TS), '')).toEqual('');
      expect(getStorageJson(SAVED_QUESTS_KEY, {})).toEqual([]);
    });
  });

  describe('storeSavedQuest', () => {
    const quest = getCheerio().load('<quest><roleplay><choice><roleplay>expected</roleplay><roleplay>wrong</roleplay></choice><choice></choice><choice if="false"></choice></roleplay></quest>')('quest');
    const pnode = new ParserNode(quest.children().eq(0), defaultContext()).getNext(0);
    const NEW_ID = '0123';
    const NEW_TS = 4567;

    if (pnode === null) {
      throw new Error('Test setup failed');
    }

    test('adds to the listing without affecting other quests', () => {
      storeSavedQuest(pnode, {id: NEW_ID} as any as Quest, NEW_TS);
      expect(getStorageJson(SAVED_QUESTS_KEY, [])).toContainEqual({ts: NEW_TS, details: {id: NEW_ID}, pathLen: 1});
    });
    test('stores xml and context path', () => {
      storeSavedQuest(pnode, {id: NEW_ID} as any as Quest, NEW_TS);
      expect(getStorageJson(savedQuestKey(NEW_ID, NEW_TS), {})).toEqual({xml: (quest + ''), path: [0]});
    });
  });

  describe('listSavedQuests', () => {
    test('loads the listing', () => {
      const list = listSavedQuests();
      expect(list.savedQuests.length).toEqual(1);
      expect(list.savedQuests[0]).toEqual({ts: STORED_QUEST_TS, details: {id: STORED_QUEST_ID}, pathLen: 1} as any);
    });
  });

  describe('loadSavedQuest', () => {
    test('replays the node given the saved path', () => {
      const action = loadSavedQuest(STORED_QUEST_ID, STORED_QUEST_TS);
      expect(action.node.elem + '').toEqual('<roleplay>expected</roleplay>');
    });
  });

  describe('saveQuestForOffline', () => {
    test.skip('Saves a publishedurl to local storage', () => { /* TODO */ });
  });
});
