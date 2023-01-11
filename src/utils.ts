import fs, { ReadStream, WriteStream } from 'fs';
import { Logger } from '@w3f/logger';
import { DeriveAccountRegistration } from '@polkadot/api-derive/accounts/types';
import { EraIndex, Event } from '@polkadot/types/interfaces';
import { ApiPromise } from '@polkadot/api';
import { EraLastBlock } from './types';

export const getDisplayName = (identity: DeriveAccountRegistration): string => {
  /* TODO
  This code is coming from https://github.com/mariopino/substrate-data-csv/blob/master/utils.js
  and needs to be refactored
  */

  if (
    identity.displayParent &&
    identity.displayParent !== `` &&
    identity.display &&
    identity.display !== ``
  ) {
    return `${identity.displayParent.replace(/\n/g, '')} / ${identity.display.replace(/\n/g, '')}`;
  } else {
    return identity.display || ``;
  }
}

const firstBlockCurrentEra = async (api: ApiPromise): Promise<number> => {

  const last = await api.rpc.chain.getHeader()
  const deriveSessionProgress = await api.derive.session.progress();
  //there is an intrinsic api error that has to be corrected next => guessed
  const guessedFirstBlockCurrentEra = last.number.unwrap().toNumber() - deriveSessionProgress.eraProgress.toNumber() + 50

  const hash = await api.rpc.chain.getBlockHash(guessedFirstBlockCurrentEra)
  const apiAt = await api.at(hash)
  const [_, firstBlockCurrentEra] = await apiAt.query.babe.epochStart()

  return firstBlockCurrentEra.toNumber()
}

const howManyErasAgo = async (eraIndex: EraIndex, api: ApiPromise): Promise<number> => {

  const currentEraIndex = (await api.query.staking.activeEra()).unwrap().index;
  return currentEraIndex.toNumber() - eraIndex.toNumber()

}

const lastBlockOf = async (eraIndex: EraIndex, api: ApiPromise): Promise<number> => {

  const howManyErasAgoVar = await howManyErasAgo(eraIndex, api)
  if (howManyErasAgoVar == 0) return (await api.rpc.chain.getHeader()).number.unwrap().toNumber()

  const lastBlockPreviousEra = await firstBlockCurrentEra(api) - 1

  const deriveSessionProgress = await api.derive.session.progress();

  // the api result is still not reliable => guessed
  const guessedResult = lastBlockPreviousEra - ((howManyErasAgoVar - 1) * deriveSessionProgress.eraLength.toNumber())

  const hash = await api.rpc.chain.getBlockHash(guessedResult + 50)
  const apiAt = await api.at(hash)
  const [_, firstBlockNextTargetEra] = await apiAt.query.babe.epochStart()

  return firstBlockNextTargetEra.toNumber() - 1

}

export const erasLastBlock = async (indexes: EraIndex[], api: ApiPromise): Promise<EraLastBlock[]> => {

  const result = await Promise.all(indexes.map(async index => {
    return { era: index, block: await lastBlockOf(index, api) }
  }))

  return result

}

export const isNewEraEvent = (event: Event, api: ApiPromise): boolean => {
  return api.events.session.NewSession.is(event)
}