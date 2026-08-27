package com.ecommerce.order.domain;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Stores the immutable purchase-time cart snapshot as a JSON text column
 * (items_json) so GET /orders/{id} can return the frozen OrderItem[] without a
 * join table. Jackson round-trips the OrderItem records.
 */
@Converter
public class OrderItemsConverter implements AttributeConverter<List<OrderItem>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(List<OrderItem> attribute) {
        try {
            return MAPPER.writeValueAsString(attribute == null ? List.of() : attribute);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize order items", e);
        }
    }

    @Override
    public List<OrderItem> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(dbData, new TypeReference<List<OrderItem>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Failed to deserialize order items", e);
        }
    }
}
