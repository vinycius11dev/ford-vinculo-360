import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}
  @Get() list(@CurrentUser() actor: AuthenticatedUser) { return this.bookings.list(actor); }
  @Post() create(@Body() input: CreateBookingDto, @CurrentUser() actor: AuthenticatedUser) { return this.bookings.create(input, actor); }
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateBookingDto, @CurrentUser() actor: AuthenticatedUser) { return this.bookings.update(id, input, actor); }
}
