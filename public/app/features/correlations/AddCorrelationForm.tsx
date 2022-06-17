import { css } from '@emotion/css';
import React from 'react';
import { useDispatch } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, Field, HorizontalGroup, Input, PanelContainer, TextArea, useStyles2 } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
// import { updateDataSource } from 'app/features/datasources/state/actions';

const getStyles = (theme: GrafanaTheme2) => ({
  panelContainer: css`
    position: relative;
    padding: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(2)};
  `,
  buttonRow: css`
    display: flex;
    justify-content: flex-end;
  `,
});

interface Props {
  onClose: () => void;
  show: boolean;
}

export const AddCorrelationForm = ({ onClose, show }: Props) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const handleClick = () => {
    // dispatch(updateDataSource());
  };

  return (
    <SlideDown in={show}>
      <PanelContainer className={styles.panelContainer}>
        <CloseButton onClick={onClose} />
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

        <div className={styles.buttonRow}>
          <Button variant="primary" icon="plus" onClick={handleClick}>
            Add
          </Button>
        </div>
      </PanelContainer>
    </SlideDown>
  );
};
