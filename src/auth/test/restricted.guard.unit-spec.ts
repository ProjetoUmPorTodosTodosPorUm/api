import { Role, User } from '@prisma/client'
import { RestrictedGuard } from '../restricted'
import * as bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { createMock, DeepMocked } from '@golevelup/nestjs-testing'
import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { MESSAGE } from 'src/constants'

describe('Restricted Guard', () => {
	let guard: RestrictedGuard
	let user: User
	let context: DeepMocked<ExecutionContext>

	const firstName = 'João'
	const email = 'joao@email.com'
	const hashedPassword = bcrypt.hashSync('password', bcrypt.genSaltSync())
	const role = Role.VOLUNTEER
	const fieldId = uuidv4()

	beforeEach(() => {
		guard = new RestrictedGuard()
		user = {
			firstName,
			email,
			hashedPassword,
			role,
			fieldId,
		} as User
		context = createMock<ExecutionContext>()
	})

	it('Should Return True (User is not restricted)', async () => {
		context.switchToHttp().getRequest.mockReturnValue({
			user,
			method: 'PUT',
		})

		expect(guard.canActivate(context)).toBeTruthy()
	})

	it('Should Return True (User is Restricted But is GET Method)', async () => {
		context.switchToHttp().getRequest.mockReturnValue({
			user: {
				...user,
				restricted: new Date(),
			},
			method: 'GET',
		})

		expect(guard.canActivate(context)).toBeTruthy()
	})

	it('Should Throw Error (User is Restricted POST METHOD)', async () => {
		try {
			context.switchToHttp().getRequest.mockReturnValue({
				user: {
					...user,
					restricted: new Date(),
				},
				method: 'POST',
			})

			guard.canActivate(context)
		} catch (error) {
			expect(error).toBeInstanceOf(ForbiddenException)
			expect(error.response.message).toBe(MESSAGE.EXCEPTION.RESTRICTED)
		}
	})

	it('Should Throw Error (User is Restricted PUT METHOD)', async () => {
		try {
			context.switchToHttp().getRequest.mockReturnValue({
				user: {
					...user,
					restricted: new Date(),
				},
				method: 'PUT',
			})

			guard.canActivate(context)
		} catch (error) {
			expect(error).toBeInstanceOf(ForbiddenException)
			expect(error.response.message).toBe(MESSAGE.EXCEPTION.RESTRICTED)
		}
	})

	it('Should Throw Error (User is Restricted DELETE METHOD)', async () => {
		try {
			context.switchToHttp().getRequest.mockReturnValue({
				user: {
					...user,
					restricted: new Date(),
				},
				method: 'DELETE',
			})

			guard.canActivate(context)
		} catch (error) {
			expect(error).toBeInstanceOf(ForbiddenException)
			expect(error.response.message).toBe(MESSAGE.EXCEPTION.RESTRICTED)
		}
	})
})
