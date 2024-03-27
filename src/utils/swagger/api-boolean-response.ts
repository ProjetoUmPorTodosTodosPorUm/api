import { applyDecorators } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

export const ApiBooleanResponse = () =>
applyDecorators(
    ApiOkResponse({
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
          },
          data: {
            type: 'boolean'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    }),
  );