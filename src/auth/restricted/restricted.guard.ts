import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { Observable } from "rxjs";
import { MESSAGE } from "src/constants";

@Injectable()
export class RestrictedGuard implements CanActivate {

	canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
		if (this.isRestricted(context)) {
			throw new ForbiddenException({
				message: MESSAGE.EXCEPTION.RESTRICTED,
				data: {},
			});
		}
		return true;
	}

	private isRestricted(context: ExecutionContext) {
		const restrictedMethods = ['POST', 'PUT', 'DELETED'];
		const { user, method }: { user: User, method: string } = context.switchToHttp().getRequest();

		return user.restricted && restrictedMethods.some(rm => rm === method.toUpperCase());
	}
}