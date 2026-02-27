export function LogErrors(operationName: string): MethodDecorator {
  return function (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const self = this as { logger?: { error: (msg: string, stack?: string) => void } };
        if (self.logger) {
          const msg = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          self.logger.error(`Failed to ${operationName}: ${msg}`, stack);
        }
        throw error;
      }
    };

    return descriptor;
  };
}
