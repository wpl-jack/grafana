import React from 'react';
import { useDispatch } from 'react-redux';

import { DataSourcePicker } from '@grafana/runtime';
import { Button, Field, HorizontalGroup, Input, Modal, TextArea } from '@grafana/ui';
// import { updateDataSource } from 'app/features/datasources/state/actions';

interface Props {
  onClose: () => void;
}

export const AddCorrelationModal = ({ onClose }: Props) => {
  const dispatch = useDispatch();

  const handleClick = () => {
    // dispatch(updateDataSource());
  };

  return (
    <Modal title="Add correlation" isOpen onDismiss={onClose}>
      <div>
        <HorizontalGroup>
          <DataSourcePicker />
          links to:
          <DataSourcePicker />
        </HorizontalGroup>
      </div>

      <Field label="Labels">
        <Input id="lol1" />
      </Field>

      <Field label="Description">
        <TextArea id="lol2" />
      </Field>

      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" icon="plus" onClick={handleClick}>
          Add
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
