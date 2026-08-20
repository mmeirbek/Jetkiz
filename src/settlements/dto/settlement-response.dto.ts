import { ApiProperty } from '@nestjs/swagger';

export class SettlementResponseDto {
  @ApiProperty({ example: 'aktau' })
  id: string;

  @ApiProperty({ example: 'Aktau' })
  name: string;

  @ApiProperty({ example: 'Актау' })
  nameRu: string;

  @ApiProperty({ example: 'Ақтау' })
  nameKk: string;

  @ApiProperty({ example: 'city' })
  type: string;

  @ApiProperty({ example: 'Aktau' })
  district: string;

  @ApiProperty({ example: 43.65 })
  latitude: number;

  @ApiProperty({ example: 51.16 })
  longitude: number;

  @ApiProperty({ example: 'Wikipedia' })
  source: string;
}

export class SettlementEnvelopeResponseDto {
  @ApiProperty({ type: SettlementResponseDto })
  settlement: SettlementResponseDto;
}

export class SettlementsListResponseDto {
  @ApiProperty({ type: [SettlementResponseDto] })
  settlements: SettlementResponseDto[];
}
