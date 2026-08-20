import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const settlements = await this.prisma.settlement.findMany({
      orderBy: [{ district: 'asc' }, { name: 'asc' }],
    });

    return { settlements };
  }

  async findOne(id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    return { settlement };
  }
}
