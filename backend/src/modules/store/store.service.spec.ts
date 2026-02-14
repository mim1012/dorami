import { Test, TestingModule } from '@nestjs/testing';
import { StoreService } from './store.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('StoreService', () => {
  let service: StoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
