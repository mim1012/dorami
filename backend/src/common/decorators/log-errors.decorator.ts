export function LogErrors(operationName: string): MethodDecorator {
  return function (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const logger = (this as any).logger;
        if (logger) {
          const msg = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          logger.error(`Failed to ${operationName}: ${msg}`, stack);
        }
        throw error;
      }
    };

    return descriptor;
  };
}
