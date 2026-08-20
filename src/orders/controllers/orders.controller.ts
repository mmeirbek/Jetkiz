import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user.type';
import { CreateOrderDto } from '../dto/create-order.dto';
import {
  OrderCreationResponseDto,
  OrderEnvelopeResponseDto,
  OrdersListResponseDto,
} from '../dto/order-response.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { OrderAssignmentService } from '../services/order-assignment.service';
import { OrdersService } from '../services/orders.service';

@Controller('orders')
@ApiTags('Orders')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Unauthorized',
})
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderAssignmentService: OrderAssignmentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create order for current user' })
  @ApiCreatedResponse({ type: OrderCreationResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid payload',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'ADMIN users cannot create orders',
  })
  create(@CurrentUser() authUser: AuthUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(authUser, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List orders related to current user' })
  @ApiOkResponse({ type: OrdersListResponseDto })
  list(@CurrentUser() authUser: AuthUser) {
    return this.ordersService.listMine(authUser);
  }

  @Get('my')
  @ApiOperation({ summary: 'List current user orders' })
  @ApiOkResponse({ type: OrdersListResponseDto })
  my(@CurrentUser() authUser: AuthUser) {
    return this.ordersService.listMine(authUser);
  }

  @Get('available')
  @ApiOperation({ summary: 'List orders available for carrier assignment' })
  @ApiOkResponse({ type: OrdersListResponseDto })
  available() {
    return this.ordersService.listAvailable();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by id' })
  @ApiOkResponse({ type: OrderEnvelopeResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  getById(@CurrentUser() authUser: AuthUser, @Param('id') orderId: string) {
    return this.ordersService.getById(authUser, orderId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update own order details' })
  @ApiOkResponse({ type: OrderEnvelopeResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid payload',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Order is not available for this user',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Only searching or newly created orders can be edited',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  update(
    @CurrentUser() authUser: AuthUser,
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(authUser, orderId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiOkResponse({ type: OrderEnvelopeResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid payload',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Status transition is not allowed for this user',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  updateStatus(
    @CurrentUser() authUser: AuthUser,
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(authUser, orderId, dto);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign available order to current carrier' })
  @ApiOkResponse({ type: OrderEnvelopeResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'CARRIER role or approved carrier profile is required',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Order is already assigned or cannot be assigned',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order or carrier profile not found',
  })
  assign(@CurrentUser() authUser: AuthUser, @Param('id') orderId: string) {
    return this.orderAssignmentService.assignToCurrentCarrier(
      authUser,
      orderId,
    );
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept available order as current carrier' })
  @ApiOkResponse({ type: OrderEnvelopeResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'CARRIER role or approved carrier profile is required',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Order is already assigned or cannot be assigned',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order or carrier profile not found',
  })
  accept(@CurrentUser() authUser: AuthUser, @Param('id') orderId: string) {
    return this.orderAssignmentService.assignToCurrentCarrier(
      authUser,
      orderId,
    );
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign available order to current carrier' })
  @ApiOkResponse({ type: OrderEnvelopeResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'CARRIER role or approved carrier profile is required',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Order is already assigned or cannot be assigned',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order or carrier profile not found',
  })
  assignPatchAlias(
    @CurrentUser() authUser: AuthUser,
    @Param('id') orderId: string,
  ) {
    return this.orderAssignmentService.assignToCurrentCarrier(
      authUser,
      orderId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete own order' })
  @ApiOkResponse({ type: OrderEnvelopeResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Order is not available for this user',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Active or delivered orders cannot be deleted',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  delete(@CurrentUser() authUser: AuthUser, @Param('id') orderId: string) {
    return this.ordersService.delete(authUser, orderId);
  }
}
