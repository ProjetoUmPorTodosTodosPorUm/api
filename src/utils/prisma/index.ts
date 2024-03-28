import { TransformFnParams } from 'class-transformer'
import { isNumeric } from 'src/utils'

export * from './types'

export class PrismaUtils {
	static exclude<T, Key extends keyof T>(model: T, ...keys: Key[]): Omit<T, Key> {
		if (!model) return model

		for (const key of keys) {
			delete model[key]
		}
		return model
	}

	static excludeMany<T, Key extends keyof T>(models: T[], ...keys: Key[]): Omit<T[], Key> {
		for (const model of models) {
			for (const key of keys) {
				delete model[key]
			}
		}
		return models
	}
}

export function transformNumbers(params: TransformFnParams) {
	let arr = params.value.split(',')
	for (let i = 0; i < arr.length; i++) {
		if (isNumeric(arr[i])) {
			arr[i] = Number(arr[i])
		}
	}

	return arr
}
